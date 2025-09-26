export const CodeInterpreting = () => {
  const items = [
    {
      href: "/code-interpreting/analyze-data-with-ai",
      title: "Analyze data with AI",
      description: "Learn how to use E2B run AI-generated code to analyze yourdata.",
      icon: "file-circle-question",
    },
    {
      href: "/code-interpreting/create-charts-visualizations",
      title: "Create charts & visualizations",
      description: "Create interactive charts by running Python code in E2B.",
      icon: "chart-waterfall",
    },
    // {
    //   href: '/code-interpreting/connect-your-data',
    //   title: 'Connect your data',
    //   description: 'TODO: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget sapien. Sed ut purus eget sapien.',
    //   icon: <Database strokeWidth={1.5} className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
    // },
    // {
    //   href: '/code-interpreting/todo',
    //   title: 'Parsing code execution results',
    //   description: 'TODO: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget sapien. Sed ut purus eget sapien.',
    //   icon: <Braces strokeWidth={1.5} className="h-5 w-5 transition-colors duration-300 fill-white/10 stroke-zinc-400 group-hover:fill-brand-300/10 group-hover:stroke-brand-400" />,
    // },
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
