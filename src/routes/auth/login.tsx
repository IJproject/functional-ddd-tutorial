import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./-login/login-page";

export const Route = createFileRoute("/auth/login")({ component: LoginPage });
