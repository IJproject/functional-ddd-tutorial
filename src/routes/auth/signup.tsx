import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "./-signup/signup-page";

export const Route = createFileRoute("/auth/signup")({ component: SignupPage });
