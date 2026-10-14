import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./styles/design-tokens.css";
import "./styles/base-layout.css";
import "./styles/form-controls.css";
import "./styles/form-layout.css";
import "./styles/tables-and-pager.css";
import "./styles/dialog.css";
import "./styles/shell-and-feedback.css";
import "./styles/responsive.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { createAppRouter } from "./app-router";
import { ToastProvider } from "./components/ui/toast-provider";
import { createQueryClient } from "./query-client";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <ToastProvider>
        <RouterProvider router={createAppRouter()} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
