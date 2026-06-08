import React from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import NavBar from "./Components/NavBar/navBarIndex";
import Errors from "./Pages/Errors.jsx";
import Home from "./Pages/Home.jsx";
import WorkWeekTimer from "./Pages/WorkWeekTimer.jsx";

const AppLayout = () => (
  <>
    <NavBar />
    <Outlet />
  </>
);

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <Errors />,
    children: [
      {
        path: "/",
        element: <WorkWeekTimer />,
      },
      {
        path: "/work-week",
        element: <WorkWeekTimer />,
      },
      {
        path: "/home",
        element: <Home />,
      },
    ],
  },
]);

export default router;
