import type { ApplyPlanView } from "#/domain/subscription/operation/apply/apply-context.dto";
import { PlanCard } from "./plan-card";

type PlanListProps = {
	plans: readonly ApplyPlanView[];
	notice: string;
	onApply: (planId: string) => void;
};

export function PlanList({ plans, notice, onApply }: PlanListProps) {
	return (
		<div className="space-y-4">
			{plans.map((plan) => (
				<PlanCard key={plan.id} plan={plan} notice={notice} onApply={onApply} />
			))}
		</div>
	);
}
