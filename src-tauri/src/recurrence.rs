use chrono::{Datelike, Duration, NaiveDate};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Freq {
    Once,
    Daily,
    Weekly,
    Monthly,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Recurrence {
    pub freq: Option<Freq>,
    #[serde(default)]
    pub days: Vec<String>, // "mon".."sun", only used when freq == Weekly
    #[serde(default = "default_interval")]
    pub interval: u32,
    pub start_date: Option<String>, // YYYY-MM-DD
    pub end_date: Option<String>,   // YYYY-MM-DD, optional
}

fn default_interval() -> u32 {
    1
}

impl Default for Freq {
    fn default() -> Self {
        Freq::Once
    }
}

fn weekday_from_str(s: &str) -> Option<chrono::Weekday> {
    use chrono::Weekday::*;
    match s.to_lowercase().as_str() {
        "mon" => Some(Mon),
        "tue" => Some(Tue),
        "wed" => Some(Wed),
        "thu" => Some(Thu),
        "fri" => Some(Fri),
        "sat" => Some(Sat),
        "sun" => Some(Sun),
        _ => None,
    }
}

/// Computes concrete occurrence dates between `window_start` and `window_end`
/// (inclusive), given a recurrence rule anchored at `start_date`.
pub fn compute_occurrences(
    rule: &Recurrence,
    window_start: NaiveDate,
    window_end: NaiveDate,
) -> Vec<NaiveDate> {
    let mut out = Vec::new();

    let Some(start_str) = &rule.start_date else {
        return out;
    };
    let Ok(start) = NaiveDate::parse_from_str(start_str, "%Y-%m-%d") else {
        return out;
    };

    let end_limit = rule
        .end_date
        .as_ref()
        .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    let effective_end = match end_limit {
        Some(e) => window_end.min(e),
        None => window_end,
    };

    if effective_end < window_start {
        return out;
    }

    let interval = rule.interval.max(1);
    let freq = rule.freq.clone().unwrap_or(Freq::Once);

    match freq {
        Freq::Once => {
            if start >= window_start && start <= effective_end {
                out.push(start);
            }
        }
        Freq::Daily => {
            // find first candidate >= window_start that's on the interval cadence from start
            let mut cursor = start;
            if cursor < window_start {
                let days_diff = (window_start - start).num_days();
                let steps = days_diff / interval as i64;
                cursor = start + Duration::days(steps * interval as i64);
                while cursor < window_start {
                    cursor += Duration::days(interval as i64);
                }
            }
            while cursor <= effective_end {
                if cursor >= window_start {
                    out.push(cursor);
                }
                cursor += Duration::days(interval as i64);
            }
        }
        Freq::Weekly => {
            let target_days: Vec<chrono::Weekday> = if rule.days.is_empty() {
                vec![start.weekday()]
            } else {
                rule.days.iter().filter_map(|d| weekday_from_str(d)).collect()
            };

            // Walk week-by-week from the start's week, respecting the interval
            // (every N weeks), and within an included week, emit each matching weekday.
            let start_week_monday = start - Duration::days(start.weekday().num_days_from_monday() as i64);
            let mut week_cursor = start_week_monday;

            // Fast-forward week_cursor close to window_start for efficiency on far-future windows.
            if week_cursor < window_start - Duration::days(7) {
                let weeks_diff = (window_start - week_cursor).num_days() / 7;
                let steps = weeks_diff / interval as i64;
                week_cursor += Duration::weeks(steps * interval as i64);
            }

            loop {
                if week_cursor > effective_end {
                    break;
                }
                for wd in &target_days {
                    let days_from_monday = wd.num_days_from_monday() as i64;
                    let candidate = week_cursor + Duration::days(days_from_monday);
                    if candidate >= start && candidate >= window_start && candidate <= effective_end {
                        out.push(candidate);
                    }
                }
                week_cursor += Duration::weeks(interval as i64);
            }
            out.sort();
        }
        Freq::Monthly => {
            // "Same day-of-month as start_date", every N months, clamped to
            // the last day of the month when the month is too short.
            let day_of_month = start.day();
            let mut y = start.year();
            let mut m = start.month();

            loop {
                let candidate = NaiveDate::from_ymd_opt(y, m, day_of_month)
                    .or_else(|| last_day_of_month(y, m));

                let Some(candidate) = candidate else {
                    // Should be unreachable (last_day_of_month always succeeds),
                    // but guard against infinite loop just in case.
                    break;
                };

                if candidate > effective_end {
                    break;
                }
                if candidate >= start && candidate >= window_start {
                    out.push(candidate);
                }

                let (ny, nm) = add_months(y, m, interval);
                y = ny;
                m = nm;

                // Safety valve: never iterate more than ~2000 months (~166 years).
                if (y - start.year()).abs() > 2000 {
                    break;
                }
            }
        }
    }

    out.sort();
    out.dedup();
    out
}

fn add_months(y: i32, m: u32, delta: u32) -> (i32, u32) {
    let total = (y * 12 + m as i32 - 1) + delta as i32;
    let ny = total.div_euclid(12);
    let nm = (total.rem_euclid(12)) as u32 + 1;
    (ny, nm)
}

fn last_day_of_month(y: i32, m: u32) -> Option<NaiveDate> {
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    NaiveDate::from_ymd_opt(ny, nm, 1).map(|d| d - Duration::days(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weekly_standup_next_2_weeks() {
        let rule = Recurrence {
            freq: Some(Freq::Weekly),
            days: vec!["mon".into(), "wed".into(), "fri".into()],
            interval: 1,
            start_date: Some("2026-07-06".into()), // a Monday
            end_date: None,
        };
        let start = NaiveDate::from_ymd_opt(2026, 7, 6).unwrap();
        let end = NaiveDate::from_ymd_opt(2026, 7, 19).unwrap();
        let occ = compute_occurrences(&rule, start, end);
        assert_eq!(occ.len(), 6); // mon/wed/fri x2 weeks
    }

    #[test]
    fn monthly_on_31st_clamps_to_last_day() {
        let rule = Recurrence {
            freq: Some(Freq::Monthly),
            days: vec![],
            interval: 1,
            start_date: Some("2026-01-31".into()),
            end_date: None,
        };
        let start = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let end = NaiveDate::from_ymd_opt(2026, 4, 30).unwrap();
        let occ = compute_occurrences(&rule, start, end);
        // Jan 31, Feb 28 (clamped), Mar 31, Apr 30 (clamped)
        assert_eq!(occ.len(), 4);
    }
}
