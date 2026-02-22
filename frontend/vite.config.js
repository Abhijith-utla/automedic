import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import path from "path";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
                secure: false,
                configure: function (proxy) {
                    proxy.on("proxyRes", function (proxyRes) {
                        var setCookie = proxyRes.headers["set-cookie"];
                        if (setCookie) {
                            proxyRes.headers["set-cookie"] = setCookie.map(function (c) {
                                return c.replace(/;\s*Path=\/[^;]*/i, "; Path=/");
                            });
                        }
                    });
                },
            },
            "/ws": { target: "ws://localhost:8000", ws: true },
        },
    },
});
