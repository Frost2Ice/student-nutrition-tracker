import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planPromotion, applyPromotion } from '../../src/domain/promotion/promote';

describe('planPromotion', () => {
  it('separates graduates (maxGrade) from promoted students', () => {
    const students = [
      { id: '1', grade: 'ป.6' },
      { id: '2', grade: 'ป.1' },
    ];
    const result = planPromotion(students, 'ป.6');
    expect(result.graduate.map((s) => s.id)).toEqual(['1']);
    expect(result.promote.map((s) => s.id)).toEqual(['2']);
  });

  it('returns empty graduate list when no students are at maxGrade', () => {
    const students = [
      { id: '1', grade: 'ป.1' },
      { id: '2', grade: 'ป.2' },
    ];
    const result = planPromotion(students, 'ป.6');
    expect(result.graduate).toHaveLength(0);
    expect(result.promote).toHaveLength(2);
  });

  it('returns empty promote list when all students are at maxGrade', () => {
    const students = [
      { id: '1', grade: 'ป.6' },
      { id: '2', grade: 'ป.6' },
    ];
    const result = planPromotion(students, 'ป.6');
    expect(result.graduate).toHaveLength(2);
    expect(result.promote).toHaveLength(0);
  });

  it('handles empty student list', () => {
    const result = planPromotion([], 'ป.6');
    expect(result.graduate).toHaveLength(0);
    expect(result.promote).toHaveLength(0);
  });
});

describe('applyPromotion', () => {
  let store: {
    students: { id: string; grade: string; room: string }[];
    updateStudent: ReturnType<typeof vi.fn>;
    deleteStudent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    store = {
      students: [
        { id: '1', grade: 'ป.6', room: '1' },
        { id: '2', grade: 'ป.1', room: '2' },
        { id: '3', grade: 'ป.3', room: '1' },
      ],
      updateStudent: vi.fn(),
      deleteStudent: vi.fn(),
    };
  });

  it('promotes student when action is promote', () => {
    applyPromotion(store, { '2': { action: 'promote' } });
    expect(store.updateStudent).toHaveBeenCalledWith('2', expect.objectContaining({ grade: 'ป.2' }));
  });

  it('promotes student and changes room when room is provided', () => {
    applyPromotion(store, { '2': { action: 'promote', room: '3' } });
    expect(store.updateStudent).toHaveBeenCalledWith('2', { grade: 'ป.2', room: '3' });
  });

  it('keeps grade the same when action is repeat (does not change grade)', () => {
    applyPromotion(store, { '3': { action: 'repeat' } });
    // student 3 should not have grade changed
    const calls = store.updateStudent.mock.calls;
    const student3Call = calls.find((c) => c[0] === '3');
    expect(student3Call).toBeUndefined();
  });

  it('updates room when action is repeat and room is provided', () => {
    applyPromotion(store, { '3': { action: 'repeat', room: '2' } });
    expect(store.updateStudent).toHaveBeenCalledWith('3', { room: '2' });
  });

  it('deletes student when action is graduate', () => {
    applyPromotion(store, { '1': { action: 'graduate' } });
    expect(store.deleteStudent).toHaveBeenCalledWith('1');
  });

  it('promotes non-max students by default (no decision)', () => {
    applyPromotion(store, {});
    // Student 2 (ป.1) should be promoted by default
    expect(store.updateStudent).toHaveBeenCalledWith('2', expect.objectContaining({ grade: 'ป.2' }));
    // Student 3 (ป.3) should be promoted by default
    expect(store.updateStudent).toHaveBeenCalledWith('3', expect.objectContaining({ grade: 'ป.4' }));
  });

  it('does not automatically graduate max-grade students when no decisions passed', () => {
    // applyPromotion with empty decisions does NOT know what maxGrade is;
    // it only acts on what's in decisions
    applyPromotion(store, {});
    // Student 1 (ป.6) has no decision -> defaults to promote (moves to next grade)
    expect(store.deleteStudent).not.toHaveBeenCalled();
  });
});
