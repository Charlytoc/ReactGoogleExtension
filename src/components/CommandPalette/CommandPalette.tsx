export type TCommand = {
  // name: string;
  description: string;
  // execute: () => void;
  node: React.ReactNode;
};

export const CommandPalette = ({ commands }: { commands: TCommand[] }) => {
  return (
    <div className="command-palette">
      <div className="command-palette-commands">
        {commands.map((command) => (
          <div title={command.description}>{command.node}</div>
        ))}
      </div>
    </div>
  );
};
