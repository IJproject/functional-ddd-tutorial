import { Button } from "#/components/control/button";
import {
	type ApplyPlanView,
	PAYMENT_REQUIRED_MESSAGE,
	TRIAL_AVAILABLE_MESSAGE,
} from "#/domain/subscription/operation/apply/apply-context.dto";

type PlanCardProps = {
	plan: ApplyPlanView;
	trialUsed: boolean;
	onApply: (planId: string) => void;
};

export function PlanCard({ plan, trialUsed, onApply }: PlanCardProps) {
	return (
		<article className="demo-card flex flex-wrap items-center justify-between gap-4">
			<div className="space-y-1">
				<p className="demo-metric-sm">{plan.name}</p>
				<p className="demo-note">
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
