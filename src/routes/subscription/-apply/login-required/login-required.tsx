import { Button } from "#/components/control/button";
import { Alert } from "#/components/feedback/alert";
import { APPLY_LOGIN_REQUIRED_MESSAGE } from "#/domain/subscription/dto/apply-context.dto";

type LoginRequiredProps = {
	errorMessages: readonly string[];
};

export function LoginRequired({ errorMessages }: LoginRequiredProps) {
	return (
		<div className="space-y-4">
			<h1 className="demo-title">サブスク申し込み</h1>
			<Alert messages={errorMessages} />
			<p className="demo-note">{APPLY_LOGIN_REQUIRED_MESSAGE}</p>
			<Button kind="link" to="/auth/login">
				ログインへ
			</Button>
		</div>
	);
}
