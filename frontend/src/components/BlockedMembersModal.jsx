import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const BlockedMembersModal = ({ open, onClose }) => {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    axiosInstance
      .get("/auth/blocked")
      .then((res) => setBlocked(res.data || []))
      .catch((e) => {
        console.error(e);
        toast.error("Failed to load blocked members");
      })
      .finally(() => setLoading(false));
  }, [open]);

  const unblock = async (id) => {
    try {
      await axiosInstance.post(`/auth/unblock/${id}`);
      setBlocked((b) => b.filter((x) => x._id !== id));
      toast.success("Unblocked");
    } catch (e) {
      console.error(e);
      toast.error("Failed to unblock");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-base-100 w-full max-w-lg rounded-md p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Blocked Members</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div className="mt-3">
          {loading ? (
            <div className="text-center py-6">Loading...</div>
          ) : blocked.length === 0 ? (
            <div className="text-center py-6 text-zinc-500">No blocked members</div>
          ) : (
            <div className="space-y-2">
              {blocked.map((u) => (
                <div key={u._id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <img src={u.profilePic || "/avatar.png"} alt="" className="size-8 rounded-full" />
                    <div>
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-xs text-zinc-500">{u.email}</div>
                    </div>
                  </div>
                  <div>
                    <button className="btn btn-sm btn-ghost" onClick={() => unblock(u._id)}>Unblock</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockedMembersModal;
