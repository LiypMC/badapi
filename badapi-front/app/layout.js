import "./globals.css";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import FloatingDecor from "../components/FloatingDecor";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <FloatingDecor />
        <NavBar />
        <main className="page">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
