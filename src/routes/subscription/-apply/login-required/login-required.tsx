import { Link } from "@tanstack/react-router";
import { Alert } from "#/components/feedback/alert";

type LoginRequiredProps = {
	errorMessages: readonly string[];
};

export function LoginRequired({ errorMessages }: LoginRequiredProps) {
	return (
		<>
			<h1 className="demo-title">サブスク申し込み</h1>
			<Alert messages={errorMessages} />
			<p>ログインしてください。</p>
			<Link to="/auth/login">ログインへ</Link>
		</>
	);
}
