export const Quickstart = () => {
  const items = [
    {
      href: "/quickstart",
      title: "Running your first Sandbox",
      description: "Learn how to start your first E2B Sandbox with our Python or JavaScript SDK.",
      icon: "circle-play",
    },
    {
      href: "/quickstart/connect-llms",
      title: "Connecting LLMs to E2B",
      description: "Connect your favorite LLM to E2B to run AI-generated code inside the Sandbox.",
      icon: "brain-circuit",
    },
    {
      href: "/quickstart/upload-download-files",
      title: "Uploading & downloading files",
      description: "A quick guide on how to upload and download files to and from the Sandbox.",
      icon: "cloud-arrow-up",
    },
    {
      href: "/quickstart/install-custom-packages",
      title: "Install custom packages",
      description: "Customize your Sandbox with third-party packages.",
      icon: "box-open-full",
    },
  ];
  return (
    <Columns cols={2}>
      {items.map((i) => (
        <Card title={i.title} href={i.href} icon={i.icon}>
          {i.description}
        </Card>
      ))}
    </Columns>
  );
};
