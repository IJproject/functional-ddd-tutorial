import { Button } from "#/components/control/button";

type LoginRequiredProps = {
	message: string;
};

export function LoginRequired({ message }: LoginRequiredProps) {
	return (
		<div className="space-y-4">
			<p className="demo-note">{message}</p>
			<Button kind="link" to="/auth/login">
				ログインへ
			</Button>
		</div>
	);
}
