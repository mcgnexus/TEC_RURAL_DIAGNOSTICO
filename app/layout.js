import "./globals.css";

export const metadata = {
  title: "TEC Rural DiagnИstico",
  description: "DiagnИsticos agrヴcolas con IA y RAG",
  icons: {
    icon: "/TecRural_icono.svg",
    apple: "/TecRural_icono.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="page-shell text-gray-900">{children}</body>
    </html>
  );
}

