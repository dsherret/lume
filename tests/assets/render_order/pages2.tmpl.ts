export const renderOrder = 1;

export default function* () {
  const pages = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  for (const page of pages) {
    yield {
      title: page,
      url: `/articles/${page}/`,
    };
  }
}
