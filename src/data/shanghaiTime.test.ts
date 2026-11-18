import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatShanghaiDate,
  formatShanghaiDateTime,
  formatShanghaiMonthDayWeek,
  formatShanghaiWeekday,
  getShanghaiCalendarDayDiff,
} from './shanghaiTime';

test('formats instants in Asia/Shanghai across the 23:59 / 00:01 boundary', () => {
  assert.equal(formatShanghaiDate('2026-11-17T23:59:00+08:00'), '2026-11-17');
  assert.equal(formatShanghaiDate('2026-11-18T00:01:00+08:00'), '2026-11-18');

  // UTC 16:01 已经是上海次日 00:01
  assert.equal(formatShanghaiDate('2026-11-17T16:01:00Z'), '2026-11-18');
  assert.equal(formatShanghaiDateTime('2026-11-17T16:01:00Z'), '2026-11-18 00:01');

  assert.equal(formatShanghaiWeekday('2026-11-18T00:01:00+08:00'), '星期三');
  assert.equal(
    formatShanghaiMonthDayWeek('2026-11-18T00:01:00+08:00'),
    '11月18日 星期三'
  );
});

test('calendar day difference uses Shanghai dates, not UTC dates', () => {
  assert.equal(
    getShanghaiCalendarDayDiff(
      '2026-11-30T23:59:00+08:00',
      '2026-12-01T00:01:00+08:00'
    ),
    1
  );
  assert.equal(
    getShanghaiCalendarDayDiff(
      '2026-11-30T23:59:00+08:00',
      '2026-12-31T23:59:00+08:00'
    ),
    31
  );
  assert.equal(
    getShanghaiCalendarDayDiff(
      '2026-12-31T23:59:00+08:00',
      '2027-01-01T00:01:00+08:00'
    ),
    1
  );
});
