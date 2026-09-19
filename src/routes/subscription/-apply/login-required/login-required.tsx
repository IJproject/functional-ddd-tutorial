import { Link } from "@tanstack/react-router";
import { Alert } from "#/components/feedback/alert";
import { APPLY_LOGIN_REQUIRED_MESSAGE } from "#/domain/subscription/dto/apply-context.dto";

type LoginRequiredProps = {
	errorMessages: readonly string[];
};

export function LoginRequired({ errorMessages }: LoginRequiredProps) {
	return (
		<>
			<h1 className="demo-title">サブスク申し込み</h1>
			<Alert messages={errorMessages} />
			<p>{APPLY_LOGIN_REQUIRED_MESSAGE}</p>
			<Link to="/auth/login">ログインへ</Link>
		</>
	);
}
