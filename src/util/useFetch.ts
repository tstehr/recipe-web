import { useEffect } from "react";
import useLocalstorage from "./useLocalstorage";
import { parseRecipe, RecipeList } from "./Recipedata";

type RecipeFiles = {
  sha: string;
  url: string;
  tree: {
    path: string;
    mode: string;
    type: string;
    sha: string;
    size: number;
    url: string;
  }[];
};

type RecipeFileList = Record<string, RecipeFiles>;

type Repository = {
  username: string;
  repository: string;
  branch: string;
};

export function useFetch(repositories: Repository[]): [RecipeList] {
  const [list, setList] = useLocalstorage<RecipeFileList>("fileList", {});
  const [recipes, setRecipes] = useLocalstorage<RecipeList>("recipes", {});
  const [updated, setUpdated] = useLocalstorage<number>("updated", 0);
  const [version, setVersion] = useLocalstorage<string>("version", "v0.0.1");


  useEffect(() => {
    // Only update once per hour or if version mismatches
    const forceVersion = version !== process.env.REACT_APP_API_VERSION;
    if(updated + 1000 * 60 * 60 > Date.now() && !forceVersion) {
      return;
    }
    repositories.forEach((repo) => {
      const listURL = `https://api.github.com/repos/${repo.username}/${repo.repository}/git/trees/${repo.branch}?recursive=1`;
      fetch(listURL)
      .then((raw) => raw.json())
      .then((result) => {
        // update recipes
        (result as RecipeFiles).tree.forEach(element => {
          // find [element] in localStorage and check if sha matches
          const updateRecipe = forceVersion || (list[repo.username]?.tree.findIndex((value) => value.path === element.path && value.sha === element.sha) ?? -1) < 0;
          if(element.path.endsWith(".md") && element.path !== "README.md" && updateRecipe) {
            const root = `https://raw.githubusercontent.com/${repo.username}/${repo.repository}/${repo.branch}/`;
            const recipeURL = new URL(element.path, root).href;
            fetch(recipeURL)
            .then((raw) => raw.text())
            .then((recipe) => {
              const parsed = parseRecipe(element.path, recipe, repo.username, root);
              setRecipes(prev => ({...prev, [parsed.slug]: parsed}));
            });
          }
        });
        if(forceVersion || !list[repo.username] || list[repo.username].sha !== (result as RecipeFiles).sha) {
          setList(old => ({...old, [repo.username]: result}));
        }
        setUpdated(Date.now());
      });
    });
    setVersion(process.env.REACT_APP_API_VERSION ?? "v0.0.1");
  }, [list, repositories, setList, setRecipes, setUpdated, updated, setVersion, version]);
  return [recipes];
};
