import { getSupabaseAdmin } from './supabase-admin';

export interface PerformanceCriterion {
    id: string;
    criterion_name: string;
    weight_percentage: number;
    scoring_type: string; // 'AUTO' | 'MANUAL' | 'HYBRID'
    source_module: string;
    calculation_method: string;
    max_score?: number; // legacy
    rules?: any;
    rating_scale_min?: number;
    rating_scale_max?: number;
}

export interface CalculatedScore {
    criterion_id: string;
    criterion_name: string;
    weight_percentage: number;
    scoring_type: string;
    source_module: string;
    calculation_method: string;
    
    // Legacy fields
    max_score: number;
    auto_score: number;
    
    // New fields
    auto_rating_out_of_10: number;
    rating_out_of_10: number;
    final_weighted_score: number;
}

export class PerformanceCalculator {
    /**
     * Calculate auto_rating_out_of_10 for all criteria of an employee in a given period.
     */
    static async calculateScores(
        employeeId: string, 
        periodStart: string, 
        periodEnd: string, 
        criteria: PerformanceCriterion[]
    ): Promise<CalculatedScore[]> {
        
        const results: CalculatedScore[] = [];

        // In a real scenario, we might batch fetch attendance & task data here
        // to avoid N+1 queries. For simplicity and as per user instruction, 
        // we'll simulate fetching read-only data for each module.

        // Simulated aggregate data
        const mockAttendancePercentage = 95; // e.g. 95% attendance
        const mockCompletedTasks = 40;
        const mockTotalTasks = 50;
        const mockCompletedBeforeDue = 35;

        for (const criterion of criteria) {
            let autoRating = 0;

            if (criterion.scoring_type === 'AUTO' || criterion.scoring_type === 'HYBRID') {
                switch (criterion.source_module) {
                    case 'ATTENDANCE':
                        // e.g. 95 / 10 = 9.5
                        autoRating = Math.min(10, Math.max(0, mockAttendancePercentage / 10));
                        break;
                    case 'PUNCTUALITY':
                        // Start from 10, deduct based on rules (mocked)
                        autoRating = Math.max(0, 10 - 1.5); // Example deduction
                        break;
                    case 'TASKS':
                    case 'WORK_REGISTER':
                        if (criterion.calculation_method === 'PERCENTAGE_TO_10') {
                            autoRating = mockTotalTasks > 0 ? (mockCompletedTasks / mockTotalTasks) * 10 : 0;
                        } else {
                            // Efficiency mock
                            autoRating = mockCompletedTasks > 0 ? (mockCompletedBeforeDue / mockCompletedTasks) * 10 : 0;
                        }
                        break;
                    default:
                        autoRating = 0;
                        break;
                }
            }

            // Ensure autoRating is rounded to 1 decimal place and between 0-10
            autoRating = Math.max(0, Math.min(10, Math.round(autoRating * 10) / 10));

            let ratingOutOf10 = autoRating;
            if (criterion.scoring_type === 'MANUAL') {
                ratingOutOf10 = 0; // Requires manual input later
            }

            const finalWeightedScore = (ratingOutOf10 / 10) * criterion.weight_percentage;

            results.push({
                criterion_id: criterion.id,
                criterion_name: criterion.criterion_name,
                weight_percentage: criterion.weight_percentage,
                scoring_type: criterion.scoring_type,
                source_module: criterion.source_module,
                calculation_method: criterion.calculation_method,
                max_score: criterion.max_score || 100, // Legacy fallback
                auto_score: autoRating * 10, // Legacy fallback
                auto_rating_out_of_10: autoRating,
                rating_out_of_10: ratingOutOf10,
                final_weighted_score: Number(finalWeightedScore.toFixed(2))
            });
        }

        return results;
    }

    /**
     * Recalculate the final score when manual ratings are updated.
     */
    static recalculateFinalScore(
        scoringType: string,
        autoRating: number,
        manualRating: number | null,
        weightPercentage: number
    ): { rating_out_of_10: number, final_weighted_score: number } {
        
        let ratingOutOf10 = 0;

        if (scoringType === 'AUTO') {
            ratingOutOf10 = autoRating;
        } else if (scoringType === 'MANUAL') {
            ratingOutOf10 = manualRating ?? 0;
        } else if (scoringType === 'HYBRID') {
            ratingOutOf10 = manualRating !== null ? manualRating : autoRating;
        }

        // Validate bounds
        ratingOutOf10 = Math.max(0, Math.min(10, ratingOutOf10));

        const finalWeightedScore = (ratingOutOf10 / 10) * weightPercentage;

        return {
            rating_out_of_10: Number(ratingOutOf10.toFixed(2)),
            final_weighted_score: Number(finalWeightedScore.toFixed(2))
        };
    }
}
