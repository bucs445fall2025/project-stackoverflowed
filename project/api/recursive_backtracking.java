
//include/exclude (Subsets)
void dfs(int[] a, int i, List<Integer> path, List<List<Integer>> out){
    if(i == a.length){
        out.add(new ArrayList<>(path));
        return;
    }
    path.add(a[i]);
    dfs(a, i+1, path, out);
    path.remove(path.size()-1);
    dfs(a, i+1, path, out);
}

//for loop with a start index (combinations/subsets)
void backtrack(int[] a, int start, List<Integer> path, List<List<Integer>> out){
    out.add(new ArrayList<>(path));
    for(int j = start; j < a.length; j++){
        path.add(a[j]);
        backtrack(a, j+1, path, out);
        path.remove(path.size()-1);
    }
}

//position fill with used[] (permutations)
//dry run with nums = [1, 2, 3]
//used = [true, false, false]
//path = empty
//out = empty

void perm(int[] a, boolean[] used, List<Integer> path, List<List<Integer>> out){
    if(path.size() == a.length){ //path.size() = 0
        out.add(new ArrayList<>(path));
        return;
    }
    for(int i = 0; i < a.length; i++){
        if(used[i]) continue; 
        used[i] = true; //used = [true, false, false]
        path.add(a[i]); //path = 1
        perm(a, used, path, out); 
        path.remove(path.size()-1);
        used[i] = false;
    }
}