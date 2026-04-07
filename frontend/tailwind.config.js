export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "#0a1014",
        "panel-bg": "#111b21",
        "panel-soft": "#202c33",
        "chat-bg": "#0b141a",
        "incoming-bubble": "#202c33",
        "outgoing-bubble": "#005c4b",
        "accent-green": "#25d366",
        "muted-text": "#8696a0",
      },
      backgroundImage: {
        "chat-pattern":
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
      },
      boxShadow: {
        soft: "0 20px 40px rgba(0, 0, 0, 0.24)",
      },
    },
  },
  plugins: [],
};
