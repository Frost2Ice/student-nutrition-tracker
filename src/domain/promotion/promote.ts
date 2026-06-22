import { isMaxGrade, promote as promoteGrade } from '../grade/ladder';

export interface PromotionPlan {
  promote: { id: string; grade: string }[];
  graduate: { id: string; grade: string }[];
}

export type DecisionAction = 'promote' | 'repeat' | 'graduate';

export interface Decision {
  action: DecisionAction;
  room?: string;
}

export interface PromotionStore {
  students: { id: string; grade: string; room: string }[];
  updateStudent: (id: string, patch: Record<string, string>) => void;
  deleteStudent: (id: string) => void;
}

export function planPromotion(
  students: { id: string; grade: string }[],
  maxGrade: string,
): PromotionPlan {
  const graduate: { id: string; grade: string }[] = [];
  const promote: { id: string; grade: string }[] = [];

  for (const s of students) {
    if (isMaxGrade(s.grade, maxGrade)) {
      graduate.push(s);
    } else {
      promote.push(s);
    }
  }

  return { promote, graduate };
}

export function applyPromotion(
  store: PromotionStore,
  decisions: Record<string, Decision>,
): void {
  for (const student of [...store.students]) {
    const decision = decisions[student.id];
    const action = decision?.action ?? 'promote';

    if (action === 'graduate') {
      store.deleteStudent(student.id);
    } else if (action === 'promote') {
      const newGrade = promoteGrade(student.grade);
      const patch: Record<string, string> = { grade: newGrade };
      if (decision?.room !== undefined) {
        patch.room = decision.room;
      }
      store.updateStudent(student.id, patch);
    } else {
      // repeat
      if (decision?.room !== undefined) {
        store.updateStudent(student.id, { room: decision.room });
      }
      // no room change: do nothing
    }
  }
}
