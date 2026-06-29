import type { ChecklistAnswer, ChecklistItem, Evidence } from '../types';
import { ChecklistItemCard } from './ChecklistItemCard';

interface Props {
  title: string;
  items: ChecklistItem[];
  answers: Record<string, ChecklistAnswer>;
  evidences: Evidence[];
  onAnswerChange: (answer: ChecklistAnswer) => void;
}

export function ChecklistSection({ title, items, answers, evidences, onAnswerChange }: Props) {
  const byGroup = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    acc[item.grupo] = acc[item.grupo] || [];
    acc[item.grupo].push(item);
    return acc;
  }, {});

  return (
    <section className="panel">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{items.length} requisitos</span>
      </div>

      {Object.entries(byGroup).map(([group, groupItems]) => (
        <div key={group} className="group-block">
          <h3>{group}</h3>
          <div className="check-list">
            {groupItems.map((item) => (
              <ChecklistItemCard
                key={item.id}
                item={item}
                answer={answers[item.id]}
                evidenceCount={evidences.filter((ev) => ev.itemId === item.id).length}
                onChange={onAnswerChange}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
