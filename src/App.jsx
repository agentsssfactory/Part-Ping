import { Routes, Route, Link } from "react-router-dom";
import { Layout, RequireRole } from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Track from "./pages/Track.jsx";
import { UserLogin, Register, AdminLogin } from "./pages/Auth.jsx";
import MyOrders from "./pages/user/MyOrders.jsx";
import NewOrder from "./pages/user/NewOrder.jsx";
import UserOrder from "./pages/user/UserOrder.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminOrder from "./pages/admin/AdminOrder.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="track" element={<Track />} />
        <Route path="track/:code" element={<Track />} />
        <Route path="login" element={<UserLogin />} />
        <Route path="register" element={<Register />} />
        <Route path="admin/login" element={<AdminLogin />} />

        <Route path="orders" element={<RequireRole role="user"><MyOrders /></RequireRole>} />
        <Route path="orders/new" element={<RequireRole role="user"><NewOrder /></RequireRole>} />
        <Route path="orders/:code" element={<RequireRole role="user"><UserOrder /></RequireRole>} />

        <Route path="admin" element={<RequireRole role="admin"><Dashboard /></RequireRole>} />
        <Route path="admin/orders" element={<RequireRole role="admin"><AdminOrders /></RequireRole>} />
        <Route path="admin/orders/:code" element={<RequireRole role="admin"><AdminOrder /></RequireRole>} />

        <Route path="*" element={<section className="card"><h1>Page not found</h1><p><Link to="/">Back home</Link></p></section>} />
      </Route>
    </Routes>
  );
}
