/**
 * icourse.club 评分查询：按 section.id（课堂号）查评分。
 * 数据由 scripts/ratings_to_ts.py 从 icourse_spider/course_rating.json 生成。
 * 未命中返回 undefined，调用方应不显示任何东西（不留"暂无"占位）。
 */
import { icourseRatings } from '@/data/icourseRatings';

export interface IcourseRatingInfo {
  score: string;
  icourseId: string;
  url: string;
  ratingCount?: number;
}

type RatingRecordValue = string | IcourseRatingInfo;

/** 按课堂号查 icourse 评分；未命中返回 undefined。 */
export function getIcourseRating(sectionId: string): string | undefined {
  return getIcourseRatingInfo(sectionId)?.score;
}

export function getIcourseRatingInfo(sectionId: string): IcourseRatingInfo | undefined {
  const value = (icourseRatings as Record<string, RatingRecordValue>)[sectionId];
  if (!value) return undefined;
  if (typeof value === 'string') {
    return {
      score: value,
      icourseId: '',
      url: 'https://www.icourse.club/',
    };
  }
  return value;
}
