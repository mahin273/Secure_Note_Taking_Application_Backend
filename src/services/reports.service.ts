import { PipelineStage } from 'mongoose';
import { User } from '../models/user.model';

export interface InterestUserSummary {
  _id: string;
  name: string;
  email: string;
}

export interface InterestGroupResult {
  _id: string;
  count: number;
  users: InterestUserSummary[];
}

export interface InterestsReportResponse {
  data: InterestGroupResult[];
  meta: {
    page: number;
    limit: number;
    totalGroups: number;
  };
}

// Scenario 1: Exactly one User.aggregate() call grouping users by interest
export async function getUsersByInterests(
  interest?: string,
  page: number = 1,
  limit: number = 20
): Promise<InterestsReportResponse> {
  const normalizedInterest = interest ? interest.toLowerCase().trim() : undefined;

  const pipeline: PipelineStage[] = [
    // Pre-unwind filter: Uses multikey Index #2 { interests: 1 } when interest is provided
    ...(normalizedInterest ? [{ $match: { interests: normalizedInterest } }] : []),

    // Deconstruct interests array
    { $unwind: '$interests' },

    // Post-unwind filter: Drops other interests from matching user documents
    ...(normalizedInterest ? [{ $match: { interests: normalizedInterest } }] : []),

    // Group by discrete interest
    {
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            name: '$name',
            email: '$email',
          },
        },
      },
    },

    // Deterministic ordering: highest count first, alphabetical tie-break
    { $sort: { count: -1, _id: 1 } },

    // Single-query pagination and total group count via $facet
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        meta: [{ $count: 'totalGroups' }],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);

  const data: InterestGroupResult[] = result?.data || [];
  const totalGroups: number = result?.meta?.[0]?.totalGroups || 0;

  return {
    data,
    meta: {
      page,
      limit,
      totalGroups,
    },
  };
}
