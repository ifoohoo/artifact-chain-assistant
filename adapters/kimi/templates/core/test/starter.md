# {测试文件名称}

<!-- 本模板是插件 starter 指导，项目本地模板可完全覆盖 -->
<!-- 测试制品通常是代码文件，此模板提供测试结构指引 -->

## 测试结构指引

### 单元测试

```typescript
describe('{模块/函数名称}', () => {
  it('should {预期行为} when {条件}', () => {
    // Arrange
    const input = {测试输入};

    // Act
    const result = {被测函数}(input);

    // Assert
    expect(result).toEqual({预期输出});
  });

  it('should throw error when {异常条件}', () => {
    // Arrange
    const invalidInput = {无效输入};

    // Act & Assert
    expect(() => {被测函数}(invalidInput)).toThrow({预期错误});
  });
});
```

### 集成测试

```typescript
describe('{模块集成}', () => {
  beforeAll(async () => {
    // 初始化测试环境
  });

  afterAll(async () => {
    // 清理测试环境
  });

  it('should {集成场景描述}', async () => {
    // Arrange
    const {依赖} = await {初始化依赖}();

    // Act
    const result = await {被测流程}({依赖});

    // Assert
    expect(result).toMatchObject({预期结果});
  });
});
```

## 测试覆盖要求

- [ ] 正常路径测试
- [ ] 边界条件测试
- [ ] 异常路径测试
- [ ] 性能关键路径测试（如适用）

## 关联制品

<!-- 在源码中使用追溯注释 -->
<!-- @feature {FEATURE_ID} -->
<!-- @scenario {SCENARIO_ID} -->
<!-- @decision {DECISION_ID} -->
