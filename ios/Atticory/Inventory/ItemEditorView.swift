import SwiftUI
import UIKit

struct ItemEditorView: View {
    enum Mode {
        case create
        case edit(InventoryItem)
    }

    let mode: Mode
    let onFinished: () -> Void

    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: ItemEditorViewModel

    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var showAnalyzeSheet = false
    @State private var analysisContext = ""

    init(mode: Mode, onFinished: @escaping () -> Void) {
        self.mode = mode
        self.onFinished = onFinished
        _viewModel = StateObject(wrappedValue: ItemEditorViewModel(mode: mode))
    }

    var body: some View {
        Form {
            Section("Photos") {
                photoSection
                HStack(spacing: 12) {
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button {
                            showCamera = true
                        } label: {
                            Label("Camera", systemImage: "camera")
                        }
                        .disabled(viewModel.remainingPhotoSlots == 0)
                    }

                    Button {
                        showLibrary = true
                    } label: {
                        Label("Gallery", systemImage: "photo.on.rectangle")
                    }
                    .disabled(viewModel.remainingPhotoSlots == 0)
                }

                Button {
                    showAnalyzeSheet = true
                } label: {
                    Label(
                        viewModel.isAnalyzing ? "Analyzing…" : "Analyze with AI",
                        systemImage: "sparkles"
                    )
                }
                .disabled(viewModel.localImages.isEmpty && viewModel.existingImageURLs.isEmpty || viewModel.isAnalyzing || viewModel.isSaving)

                if let status = viewModel.analysisStatusMessage {
                    Text(status)
                        .font(.footnote)
                        .foregroundStyle(AppTheme.mutedForeground)
                }
            }

            Section("Details") {
                TextField("Name", text: $viewModel.name)
                Picker("Category", selection: $viewModel.category) {
                    Text("None").tag("")
                    ForEach(viewModel.categories) { category in
                        Text(category.name).tag(category.name)
                    }
                }
                TextField("Description", text: $viewModel.description, axis: .vertical)
                    .lineLimit(3 ... 6)

                Picker("Condition", selection: $viewModel.conditionType) {
                    Text("Select…").tag(Optional<ConditionType>.none)
                    ForEach(ConditionType.allCases) { type in
                        Text(type.label).tag(Optional(type))
                    }
                }

                if viewModel.conditionType == .preOwned {
                    Picker("Grade", selection: $viewModel.conditionGrade) {
                        Text("Select…").tag(Optional<PreOwnedGrade>.none)
                        ForEach(PreOwnedGrade.allCases) { grade in
                            Text(grade.label).tag(Optional(grade))
                        }
                    }
                }

                Stepper("Quantity: \(viewModel.quantity)", value: $viewModel.quantity, in: 1 ... 999)
            }

            Section("Weight") {
                HStack {
                    TextField("Pounds", value: $viewModel.weightPounds, format: .number)
                        .keyboardType(.numberPad)
                    TextField("Ounces", value: $viewModel.weightOunces, format: .number)
                        .keyboardType(.decimalPad)
                }
            }

            Section("Pricing") {
                moneyField("Cost", value: $viewModel.cost)
                moneyField("Projected sale", value: $viewModel.projectedSalePrice)
                moneyField("Starting bid", value: $viewModel.startingBid)
                Toggle("Sold", isOn: $viewModel.hasActualSale)
                if viewModel.hasActualSale {
                    moneyField("Actual sale", value: $viewModel.actualSalePrice)
                    Toggle("Partial sale", isOn: $viewModel.partialSale)
                    if viewModel.partialSale {
                        Stepper(
                            "Units sold: \(viewModel.unitsSold)",
                            value: $viewModel.unitsSold,
                            in: 1 ... max(1, viewModel.quantity)
                        )
                    }
                    Picker("Payment method", selection: $viewModel.paymentMethod) {
                        Text("Select…").tag(Optional<PaymentMethod>.none)
                        ForEach(PaymentMethod.allCases) { method in
                            Text(method.label).tag(Optional(method))
                        }
                    }
                }
            }

            Section {
                Toggle("Queue AI analysis after save", isOn: $viewModel.runAnalysisAfterSave)
            }

            if let error = viewModel.errorMessage {
                Section {
                    ErrorBanner(message: error)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .appScreenBackground()
        .navigationTitle(modeTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(viewModel.isSaving ? "Saving…" : "Save") {
                    Task {
                        if await viewModel.save() {
                            onFinished()
                            dismiss()
                        }
                    }
                }
                .disabled(viewModel.isSaving || viewModel.isAnalyzing || !viewModel.canSave)
            }
        }
        .task {
            await viewModel.loadCategories()
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                showCamera = false
                if let image {
                    viewModel.addImages([image])
                }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showLibrary) {
            PhotoLibraryPicker(maxSelection: viewModel.remainingPhotoSlots) { images in
                showLibrary = false
                viewModel.addImages(images)
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showAnalyzeSheet) {
            NavigationStack {
                Form {
                    Section {
                        Text("AI will inspect your photos and fill name, category, description, condition, and pricing suggestions.")
                            .font(.footnote)
                            .foregroundStyle(AppTheme.mutedForeground)
                        TextField("Extra context (optional)", text: $analysisContext, axis: .vertical)
                            .lineLimit(3 ... 5)
                    }
                }
                .navigationTitle("Analyze")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showAnalyzeSheet = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Run") {
                            showAnalyzeSheet = false
                            Task { await viewModel.analyze(context: analysisContext) }
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
        .onChange(of: viewModel.didUnauthorized) { _, unauthorized in
            if unauthorized {
                Task { await session.handleUnauthorized() }
            }
        }
    }

    private var modeTitle: String {
        switch mode {
        case .create: "Add item"
        case .edit: "Edit item"
        }
    }

    private var photoSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(Array(viewModel.existingImageURLs.enumerated()), id: \.offset) { index, url in
                    ZStack(alignment: .topTrailing) {
                        RemoteImage(path: url)
                            .frame(width: 96, height: 96)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        removeButton { viewModel.removeExistingImage(at: index) }
                    }
                }
                ForEach(Array(viewModel.localImages.enumerated()), id: \.offset) { index, image in
                    ZStack(alignment: .topTrailing) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 96, height: 96)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        removeButton { viewModel.removeLocalImage(at: index) }
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func removeButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "xmark.circle.fill")
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, .black.opacity(0.65))
        }
        .offset(x: 4, y: -4)
    }

    private func moneyField(_ title: String, value: Binding<Double>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(title, value: value, format: .currency(code: "USD"))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
        }
    }
}

@MainActor
final class ItemEditorViewModel: ObservableObject {
    @Published var name = ""
    @Published var category = ""
    @Published var description = ""
    @Published var conditionType: ConditionType?
    @Published var conditionGrade: PreOwnedGrade?
    @Published var quantity = 1
    @Published var weightPounds = 0
    @Published var weightOunces: Double = 0
    @Published var startingBid: Double = 0
    @Published var cost: Double = 0
    @Published var projectedSalePrice: Double = 0
    @Published var hasActualSale = false
    @Published var actualSalePrice: Double = 0
    @Published var partialSale = false
    @Published var unitsSold = 1
    @Published var paymentMethod: PaymentMethod?
    @Published var existingImageURLs: [String] = []
    @Published var localImages: [UIImage] = []
    @Published var categories: [Category] = []
    @Published var runAnalysisAfterSave = false
    @Published var analysisStatusMessage: String?
    @Published var errorMessage: String?
    @Published var isSaving = false
    @Published var isAnalyzing = false
    @Published var didUnauthorized = false

    private let mode: ItemEditorView.Mode
    private let client = APIClient.shared
    private var aiEvidence: ItemAiEvidence?
    private var itemId: String?

    init(mode: ItemEditorView.Mode) {
        self.mode = mode
        if case .edit(let item) = mode {
            itemId = item.uuid
            name = item.name
            category = item.category
            description = item.description
            let parsed = ParsedCondition.parse(item.condition)
            conditionType = parsed.type
            conditionGrade = parsed.grade
            quantity = item.quantity
            weightPounds = item.weightPounds
            weightOunces = item.weightOunces
            startingBid = item.startingBid
            cost = item.cost
            projectedSalePrice = item.projectedSalePrice
            if let actual = item.actualSalePrice {
                hasActualSale = true
                actualSalePrice = actual
            }
            partialSale = item.partialSale
            unitsSold = item.unitsSold ?? 1
            paymentMethod = item.paymentMethod
            existingImageURLs = item.imageUrls
            aiEvidence = item.aiEvidence
        }
    }

    var remainingPhotoSlots: Int {
        max(0, 4 - existingImageURLs.count - localImages.count)
    }

    var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && cost >= 0
            && projectedSalePrice >= 0
    }

    func addImages(_ images: [UIImage]) {
        let allowed = Array(images.prefix(remainingPhotoSlots))
        localImages.append(contentsOf: allowed)
    }

    func removeExistingImage(at index: Int) {
        guard existingImageURLs.indices.contains(index) else { return }
        existingImageURLs.remove(at: index)
    }

    func removeLocalImage(at index: Int) {
        guard localImages.indices.contains(index) else { return }
        localImages.remove(at: index)
    }

    func loadCategories() async {
        do {
            categories = try await client.listCategories()
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            }
        } catch {
            // Categories are optional for saving; ignore soft failures.
        }
    }

    func analyze(context: String) async {
        isAnalyzing = true
        analysisStatusMessage = "Preparing photo…"
        errorMessage = nil
        defer { isAnalyzing = false }

        do {
            let data: Data
            let filename: String
            if let sourceImage = localImages.first,
               let jpeg = ImageUploadHelper.jpegData(from: sourceImage)
            {
                data = jpeg
                filename = ImageUploadHelper.filename()
            } else if let path = existingImageURLs.first,
                      let url = AppConfig.resolveImageURL(path)
            {
                analysisStatusMessage = "Downloading photo…"
                let (remoteData, _) = try await URLSession.shared.data(from: url)
                data = remoteData
                filename = (path as NSString).lastPathComponent
            } else {
                errorMessage = "Add at least one photo before analyzing."
                analysisStatusMessage = nil
                return
            }

            analysisStatusMessage = "Sending photo to AI…"
            let result = try await client.analyzeImage(
                imageData: data,
                filename: filename,
                context: context
            )
            apply(analysis: result)
            analysisStatusMessage = "AI suggestions applied. Review and save."
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            } else {
                errorMessage = error.message
                analysisStatusMessage = nil
            }
        } catch {
            errorMessage = error.localizedDescription
            analysisStatusMessage = nil
        }
    }

    func save() async -> Bool {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            var uploaded = existingImageURLs
            for (index, image) in localImages.enumerated() {
                guard let data = ImageUploadHelper.jpegData(from: image) else {
                    throw APIError(status: 0, message: "Could not encode photo \(index + 1).")
                }
                let response = try await client.uploadImage(
                    imageData: data,
                    filename: ImageUploadHelper.filename(for: index)
                )
                uploaded.append(response.imageUrl)
            }

            let condition = ParsedCondition(type: conditionType, grade: conditionGrade).serialize()
            let actual: Double? = hasActualSale ? actualSalePrice : nil
            let isPartial = hasActualSale && partialSale
            let soldUnits: Int? = isPartial ? min(max(unitsSold, 1), quantity) : nil
            let method: PaymentMethod? = hasActualSale ? paymentMethod : nil

            if isPartial, unitsSold > quantity {
                errorMessage = "Units sold cannot exceed quantity."
                return false
            }

            switch mode {
            case .create:
                let body = CreateInventoryItemRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    category: category,
                    description: description,
                    condition: condition,
                    quantity: quantity,
                    weightPounds: weightPounds,
                    weightOunces: weightOunces,
                    startingBid: startingBid,
                    cost: cost,
                    projectedSalePrice: projectedSalePrice,
                    actualSalePrice: actual,
                    partialSale: isPartial,
                    unitsSold: soldUnits,
                    paymentMethod: method,
                    imageUrls: uploaded,
                    aiEvidence: aiEvidence,
                    runAnalysis: runAnalysisAfterSave,
                    analysisContext: nil
                )
                _ = try await client.createInventoryItem(body)
            case .edit:
                guard let itemId else { return false }
                let body = UpdateInventoryItemRequest(
                    name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                    category: category,
                    description: description,
                    condition: condition,
                    quantity: quantity,
                    weightPounds: weightPounds,
                    weightOunces: weightOunces,
                    startingBid: startingBid,
                    cost: cost,
                    projectedSalePrice: projectedSalePrice,
                    actualSalePrice: actual,
                    partialSale: isPartial,
                    unitsSold: soldUnits,
                    paymentMethod: method,
                    imageUrls: uploaded,
                    aiEvidence: aiEvidence,
                    runAnalysis: runAnalysisAfterSave ? true : nil,
                    analysisContext: nil
                )
                _ = try await client.updateInventoryItem(uuid: itemId, body)
            }
            return true
        } catch let error as APIError {
            if error == .unauthorized {
                didUnauthorized = true
            } else {
                errorMessage = error.message
            }
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func apply(analysis: ItemAnalysisResponse) {
        if !analysis.name.isEmpty { name = analysis.name }
        if !analysis.category.isEmpty { category = analysis.category }
        if !analysis.description.isEmpty { description = analysis.description }
        if !analysis.conditionSuggestion.isEmpty {
            let parsed = ParsedCondition.parse(analysis.conditionSuggestion)
            conditionType = parsed.type
            conditionGrade = parsed.grade
        }
        projectedSalePrice = analysis.projectedSalePrice
        startingBid = analysis.startingBidSuggestion
        aiEvidence = ItemAiEvidence(
            comparableListings: analysis.comparableListings,
            platformEstimates: analysis.platformEstimates,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning
        )
    }
}
