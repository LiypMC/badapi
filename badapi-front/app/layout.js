import "./globals.css";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="page">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
