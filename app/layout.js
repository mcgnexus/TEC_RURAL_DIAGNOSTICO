import "./globals.css";

export const metadata = {
  title: "TEC Rural Diagnóstico",
  description: "Diagnósticos agrícolas con IA y RAG",
  icons: {
    icon: '/TecRural_icono.svg',
    apple: '/TecRural_icono.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="page-shell text-gray-900">{children}</body>
    </html>
  );
}
