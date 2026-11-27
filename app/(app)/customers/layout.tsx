/**
 * Customers segment layout: keeps the kanban in `children` while `@modal`
 * soft-navigates deal detail as an overlay.
 */
export default function CustomersLayout(props: LayoutProps<"/customers">) {
  return (
    <>
      {props.children}
      {props.modal}
    </>
  );
}
