import { Button } from "#/components/control/button";
import {
	PAYMENT_REQUIRED_MESSAGE,
	type PlanView,
	TRIAL_AVAILABLE_MESSAGE,
} from "#/domain/subscription/dto/apply.dto";

type PlanCardProps = {
	plan: PlanView;
	trialUsed: boolean;
	onApply: (planId: string) => void;
};

export function PlanCard({ plan, trialUsed, onApply }: PlanCardProps) {
	return (
		<article className="demo-card flex items-center justify-between">
			<div>
				<strong>{plan.name}</strong>
				<p className="demo-muted">
					月額 ¥{plan.monthlyPrice.toLocaleString()}・
					{trialUsed ? PAYMENT_REQUIRED_MESSAGE : TRIAL_AVAILABLE_MESSAGE}
				</p>
			</div>
			<Button kind="action" onClick={() => onApply(plan.id)}>
				申し込む
			</Button>
		</article>
	);
}
