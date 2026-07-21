import { Panel } from "../../../components/ui/Panel";

type Props = {
  items: string[];
};

export function WorkQueuePanel({ items }: Props) {
  return (
    <Panel>
      <p className="eyebrow">İş Kuyruğu</p>
      <h2>Şimdi Yap</h2>

      <div className="task-list">
        {items.map((task) => (
          <label key={task}>
            <input type="checkbox" />
            <span>{task}</span>
          </label>
        ))}
      </div>
    </Panel>
  );
}
