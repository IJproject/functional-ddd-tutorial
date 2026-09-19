import type { ApplyPlanView } from "#/domain/subscription/dto/apply-context.dto";
import { PlanCard } from "./plan-card";

type PlanListProps = {
	plans: readonly ApplyPlanView[];
	trialUsed: boolean;
	onApply: (planId: string) => void;
};

export function PlanList({ plans, trialUsed, onApply }: PlanListProps) {
	return (
		<div className="space-y-4">
			{plans.map((plan) => (
				<PlanCard
					key={plan.id}
					plan={plan}
					trialUsed={trialUsed}
					onApply={onApply}
				/>
			))}
		</div>
	);
}
