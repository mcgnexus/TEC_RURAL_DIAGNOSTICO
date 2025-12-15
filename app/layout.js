import "./globals.css";

export const metadata = {
  title: "TEC Rural Diagnóstico",
  description: "Diagnósticos agrícolas con IA y RAG",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="page-shell text-gray-900">{children}</body>
    </html>
  );
}
