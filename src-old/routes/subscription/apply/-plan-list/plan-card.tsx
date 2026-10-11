import { Button } from "#/components/control/button";
import type { ApplyPlanView } from "#/domain/subscription/operation/apply/apply-view.dto";

type PlanCardProps = {
	plan: ApplyPlanView;
	notice: string;
	onApply: (planId: string) => void;
};

export function PlanCard({ plan, notice, onApply }: PlanCardProps) {
	return (
		<article className="demo-card flex flex-wrap items-center justify-between gap-4">
			<div className="space-y-1">
				<p className="demo-metric-sm">{plan.name}</p>
				<p className="demo-note">
					月額 ¥{plan.monthlyPrice.toLocaleString()}・{notice}
				</p>
			</div>
			<Button kind="action" onClick={() => onApply(plan.id)}>
				申し込む
			</Button>
		</article>
	);
}
