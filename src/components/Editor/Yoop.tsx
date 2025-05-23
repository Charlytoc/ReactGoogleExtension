// import YooptaEditor, {
//   createYooptaEditor,
//   //   Elements,
//   //   Blocks,
//   //   useYooptaEditor,
//   YooptaContentValue,
//   YooptaOnChangeOptions,
// } from "@yoopta/editor";

// import Paragraph from "@yoopta/paragraph";
// import Blockquote from "@yoopta/blockquote";
// import Embed from "@yoopta/embed";
// import Image from "@yoopta/image";
// import Link from "@yoopta/link";
// import Callout from "@yoopta/callout";
// import Video from "@yoopta/video";
// import File from "@yoopta/file";
// import Accordion from "@yoopta/accordion";
// import { NumberedList, BulletedList, TodoList } from "@yoopta/lists";
// import {
//   Bold,
//   Italic,
//   CodeMark,
//   Underline,
//   Strike,
//   Highlight,
// } from "@yoopta/marks";
// import { HeadingOne, HeadingThree, HeadingTwo } from "@yoopta/headings";
// import Code from "@yoopta/code";
// import Table from "@yoopta/table";
// import Divider from "@yoopta/divider";
// import ActionMenuList, {
//   DefaultActionMenuRender,
// } from "@yoopta/action-menu-list";
// import Toolbar, { DefaultToolbarRender } from "@yoopta/toolbar";
// import LinkTool, { DefaultLinkToolRender } from "@yoopta/link-tool";

// //   import { uploadToCloudinary } from '@/utils/cloudinary';
// import { useMemo, useRef, useState } from "react";
// // import { WITH_BASIC_INIT_VALUE } from "./initValue";

// const plugins = [
//   Paragraph,
//   Table,
//   Divider.extend({
//     elementProps: {
//       divider: (props) => ({
//         ...props,
//         color: "#007aff",
//       }),
//     },
//   }),
//   Accordion,
//   HeadingOne,
//   HeadingTwo,
//   HeadingThree,
//   Blockquote,
//   Callout,
//   NumberedList,
//   BulletedList,
//   TodoList,
//   Code,
//   Link,
//   Embed,
//   Image.extend({
//     options: {
//       async onUpload(file) {
//         //   const data = await uploadToCloudinary(file, 'image');

//         return {
//           src: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
//           alt: "cloudinary",
//           sizes: {
//             width: 272,
//             height: 92,
//           },
//         };
//       },
//     },
//   }),
//   Video.extend({
//     options: {
//       onUpload: async (file) => {
//         // const data = await uploadToCloudinary(file, "video");
//         return {
//           src: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
//           alt: "cloudinary",
//           sizes: {
//             width: 272,
//             height: 92,
//           },
//         };
//       },
//       onUploadPoster: async (file) => {
//         // const image = await uploadToCloudinary(file, "image");
//         return "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png";
//       },
//     },
//   }),
//   File.extend({
//     options: {
//       onUpload: async (file) => {
//         // const response = await uploadToCloudinary(file, "auto");
//         return {
//           src: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png",
//           format: "png",
//           name: "google.png",
//           size: 1000,
//         };
//       },
//     },
//   }),
// ];

// const TOOLS = {
//   ActionMenu: {
//     render: DefaultActionMenuRender,
//     tool: ActionMenuList,
//   },
//   Toolbar: {
//     render: DefaultToolbarRender,
//     tool: Toolbar,
//   },
//   LinkTool: {
//     render: DefaultLinkToolRender,
//     tool: LinkTool,
//   },
// };

// const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];

// function WithBaseFullSetup() {
//   const [value, setValue] = useState<YooptaContentValue>();
//   const editor = useMemo(() => createYooptaEditor(), []);
//   const selectionRef = useRef(null);

//   const onChange = (
//     newValue: YooptaContentValue,
//     options: YooptaOnChangeOptions
//   ) => {
//     setValue(newValue);
//   };

//   return (
//     <div
//       className="md:py-[100px] md:pl-[200px] md:pr-[80px] px-[20px] pt-[80px] pb-[40px] flex justify-center"
//       ref={selectionRef}
//     >
//       <YooptaEditor
//         editor={editor}
//         plugins={plugins as any}
//         tools={TOOLS}
//         marks={MARKS}
//         selectionBoxRoot={selectionRef}
//         value={value}
//         onChange={onChange}
//         autoFocus
//       />
//     </div>
//   );
// }

// export default WithBaseFullSetup;
