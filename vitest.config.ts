import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import vue from "@vitejs/plugin-vue"


export default defineConfig({
    plugins: [react({ include: "./tests/react/**" }), vue({ include: "./tests/vue/**" })],
    test: {
        environment: "jsdom"
    }
})