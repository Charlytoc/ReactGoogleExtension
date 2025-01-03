import { useParams, useNavigate } from "react-router";

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <div>
      NoteDetail {id}
      <button onClick={() => navigate("/notes")}>Back</button>
    </div>
  );
}
