import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const NewGroupModal = ({ open, onClose }) => {
  const { users, getUsers } = useChatStore();
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) getUsers();
  }, [open, getUsers]);

  const toggleMember = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const createGroup = async () => {
    // lightweight local mock: in absence of backend group endpoint, just notify
    if (!groupName) return toast.error("Group name is required");
    if (selected.length === 0) return toast.error("Add at least one member");
    // TODO: call backend group creation endpoint when available
    toast.success(`Group '${groupName}' created with ${selected.length} members (mock)`);
    setGroupName("");
    setSelected([]);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 w-full max-w-xl rounded-md p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">New Group</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="mt-3">
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="input w-full" />
        </div>

        <div className="mt-3 max-h-56 overflow-y-auto border-t pt-3">
          {users.map((u) => (
            <label key={u._id} className="flex items-center gap-3 py-1">
              <input type="checkbox" checked={selected.includes(u._id)} onChange={() => toggleMember(u._id)} className="checkbox" />
              <img src={u.profilePic || "/avatar.png"} alt="" className="size-8 rounded-full" />
              <span className="truncate">{u.fullName}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={createGroup}>Create</button>
        </div>
      </div>
    </div>
  );
};

export default NewGroupModal;
