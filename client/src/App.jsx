import { useCallback, useEffect, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import Status from "./pages/Status.jsx";
import Performance from "./pages/Performance.jsx";
import About from "./pages/About.jsx";
import { api } from "./services/api.js";

export default function App() {
  const [page, setPage] = useState("home");
  const [instance, setInstance] = useState(null);
  const [uptimeSeconds, setUptimeSeconds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshInstance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInstance(await api.instance());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refreshInstance();
  }, [refreshInstance]);
  useEffect(() => {
    if (typeof instance?.uptimeSeconds === "number") {
      setUptimeSeconds(instance.uptimeSeconds);
    }
  }, [instance?.uptimeSeconds]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setUptimeSeconds((current) =>
        typeof current === "number" ? current + 1 : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const props = {
    instance,
    uptimeSeconds,
    instanceLoading: loading,
    loading,
    error,
    refresh: refreshInstance,
    setPage,
  };
  const pages = {
    home: <Home {...props} />,
    status: <Status {...props} />,
    performance: <Performance {...props} />,
    about: <About />,
  };
  return (
    <>
      <Navbar page={page} setPage={setPage} />
      {pages[page]}
      <footer></footer>
    </>
  );
}
