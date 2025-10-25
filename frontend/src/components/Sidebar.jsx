import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users } from "lucide-react";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const { searchQuery, setSearchQuery, searchMode, setSearchMode } = useChatStore();

  useEffect(() => {
    getUsers();
  }, [getUsers]);


  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  // Apply people search when searchMode is 'people'
  const displayedUsers =
    searchMode === "people" && searchQuery
      ? filteredUsers.filter(
          (user) =>
            user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : filteredUsers;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium hidden lg:block">Contacts</span>

          {/* Move "Show online only" next to Contacts (right-aligned on large screens) */}
          <label className="ml-auto cursor-pointer hidden lg:flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
        </div>

        {/* Search input with visible boundary that darkens on focus */}
        <div className="mt-3 w-full">
          <div className="p-1 border border-base-300 rounded-md focus-within:border-zinc-900 transition-colors">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people or messages"
              className="input input-sm w-full bg-transparent border-0 focus:outline-none"
            />
          </div>

          {/* Mode toggle - visible on larger screens */}
          <div className="mt-2 hidden lg:flex items-center gap-2">
            <button
              onClick={() => setSearchMode("people")}
              className={`btn btn-ghost btn-xs ${searchMode === "people" ? "btn-active" : ""}`}
            >
              People
            </button>
            <button
              onClick={() => setSearchMode("messages")}
              className={`btn btn-ghost btn-xs ${searchMode === "messages" ? "btn-active" : ""}`}
            >
              Messages
            </button>

            <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto w-full py-3">
  {displayedUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="hidden lg:block text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              {/* Removed explicit Online/Offline text - status now visible via green indicator on avatar */}
            </div>
          </button>
        ))}

        {displayedUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No users</div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
