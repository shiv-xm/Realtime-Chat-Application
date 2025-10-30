import { axiosInstance } from "./axios";

export async function proofread({ text, tone = "neutral" }) {
  const res = await axiosInstance.post("/ai/proofread", { text, tone });
  return res.data;
}

export async function assistant({ instruction, context = [] }) {
  const res = await axiosInstance.post("/ai/assistant", { instruction, context });
  return res.data;
}

export async function smartReplies({ message, context = [], tone = "neutral" }) {
  const res = await axiosInstance.post("/ai/smart-replies", { message, context, tone });
  return res.data;
}

export async function rewrite({ text, style = "neutral" }) {
  const res = await axiosInstance.post("/ai/rewrite", { text, style });
  return res.data;
}

export default { proofread, assistant, smartReplies, rewrite };
