/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        clinical: {
          bg: "#f8fafc",
          surface: "#ffffff",
          border: "#e2e8f0",
          muted: "#64748b",
          primary: "#b91c1c",
          primaryHover: "#991b1b",
          danger: "#dc2626",
          dangerBg: "#fef2f2",
          info: "#2563eb",
          infoBg: "#eff6ff",
          /** Status: risk / vitals / NEWS2 */
          statusLow: "#b91c1c",
          statusLowBg: "#fef2f2",
          statusMedium: "#d97706",
          statusMediumBg: "#fffbeb",
          statusHigh: "#7f1d1d",
          statusHighBg: "#fef2f2",
          /** Category tags (soft, accessible) */
          catMusculoskeletal: "#0ea5e9",
          catPsych: "#8b5cf6",
          catCardiac: "#e11d48",
          catSymptom: "#64748b",
          catLifestyle: "#b91c1c",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["DM Sans", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
