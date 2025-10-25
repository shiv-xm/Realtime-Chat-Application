import React from "react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

const ReactionPicker = ({ onSelect }) => {
  return (
    <div className="bg-base-100 border rounded-md p-2 flex gap-2 shadow">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => onSelect(e)}
          className="text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-base-200"
        >
          {e}
        </button>
      ))}
    </div>
  );
};

export default ReactionPicker;
