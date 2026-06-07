import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		TanStackRouterVite({ routesDirectory: "./src/routes" }),
		react(),
		tailwindcss(),
		{
			name: "runtime-config",
			configureServer(server) {
				server.middlewares.use("/config.js", (_req, res) => {
					res.setHeader("Content-Type", "application/javascript");
					res.end(
						`window.__RUNTIME_CONFIG__=${JSON.stringify({ apiBaseUrl: "/api" })}`,
					);
				});
			},
		},
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:8091",
				changeOrigin: true,
				rewrite: (proxyPath) => proxyPath.replace(/^\/api/, ""),
			},
		},
	},
});
