import type { ReactNode } from "react";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function renderMarkdownLinks(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	for (
		match = MARKDOWN_LINK_PATTERN.exec(text);
		match;
		match = MARKDOWN_LINK_PATTERN.exec(text)
	) {
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}

		parts.push(
			<a
				key={`${match.index}-${match[2]}`}
				href={match[2]}
				target="_blank"
				rel="noopener noreferrer"
				className="text-[hsl(var(--primary))] underline"
			>
				{match[1]}
			</a>,
		);

		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts.length > 0 ? parts : [text];
}
