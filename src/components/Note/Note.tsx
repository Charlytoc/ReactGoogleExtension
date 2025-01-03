import { SVGS } from "../../assets/svgs";
import { TNote } from "../../types";
import { Button } from "../Button/Button";

import "./Note.css";
import { useNavigate } from "react-router";

type TNoteProps = TNote & {
  deleteNote?: () => void;
};

export const Note = ({ title, deleteNote, id }: TNoteProps) => {
  const navigate = useNavigate();
  

  return (
    <div className="note">
      <h4>{title}</h4>
      <Button
        className="w-100 justify-center padding-5"
        svg={SVGS.trash}
        text="de"
        onClick={deleteNote}
        confirmations={[{ text: "sure?", svg: SVGS.close }]}
      />
      <Button
        className="w-100 justify-center padding-5"
        svg={SVGS.edit}
        text="expand"
        onClick={() => {
          console.log(id);
          navigate(`/notes/${id}`);
        }}
      />
    </div>
  );
};
