import type { PlanView } from "#/domain/subscription/dto/apply.dto";
import { PlanCard } from "./plan-card";

type PlanListProps = {
	plans: readonly PlanView[];
	trialUsed: boolean;
	onApply: (planId: string) => void;
};

export function PlanList({ plans, trialUsed, onApply }: PlanListProps) {
	return (
		<div className="space-y-3">
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
