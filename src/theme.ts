import { createTheme, MantineColorsTuple } from "@mantine/core";

/**
 * Custom purple primary color palette based on --active-color (#be90ff).
 * 10 shades from lightest (0) to darkest (9).
 */
const purple: MantineColorsTuple = [
  "#f3ecff", // 0 - lightest
  "#e2d2fb", // 1
  "#c9abf7", // 2
  "#be90ff", // 3 - base (matches --active-color)
  "#a96ef5", // 4
  "#9554e8", // 5
  "#7e3dd4", // 6 - primary shade (used for buttons, etc.)
  "#6a2fba", // 7
  "#55239e", // 8
  "#3f1a7a", // 9 - darkest
];

export const theme = createTheme({
  /** Use the custom purple as the primary color */
  primaryColor: "purple",
  primaryShade: 6,

  colors: {
    purple,
    // Dark background shades matching --bg-color (#09090d) and --bg-color-secondary (#1b1b33)
    dark: [
      "#C1C2C5", // 0 - lightest text
      "#A6A7AB", // 1
      "#909296", // 2
      "#5C5F66", // 3
      "#373A40", // 4
      "#2C2E33", // 5
      "#1b1b33", // 6 - matches --bg-color-secondary
      "#141426", // 7
      "#0e0e1a", // 8
      "#09090d", // 9 - matches --bg-color
    ],
  },

  /** Font family matching existing :root setting */
  fontFamily: "Inter, Poppins, system-ui, Avenir, Helvetica, Arial, sans-serif",
  fontFamilyMonospace:
    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",

  /** Default border radius */
  defaultRadius: "sm",

  /** Heading styles */
  headings: {
    fontFamily:
      "Inter, Poppins, system-ui, Avenir, Helvetica, Arial, sans-serif",
  },

  /** Component defaults */
  components: {
    /** Make ActionIcons subtle by default for a cleaner look */
    ActionIcon: {
      defaultProps: {
        variant: "subtle",
      },
    },
  },
});
